// TIKTOOOO maintained Worker, 2026-10-31. AGPL-3.0. Sources: https://github.com/TIKTOOOO/loon/tree/main/location-spoofer/source

// location-picker/worker/src/page.js
var PAGE = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>定位选点</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous">
<style>
  html,body{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
  .bar{padding:8px;display:flex;gap:6px;box-sizing:border-box}
  .bar input{flex:1;min-width:0;padding:10px;font-size:16px;border:1px solid #ccc;border-radius:8px}
  .bar select{max-width:110px;font-size:14px}
  .bar button{padding:10px 14px;font-size:16px;border:0;border-radius:8px;background:#007aff;color:#fff}
  .bar button:disabled{opacity:.55}
  .results{margin:0 8px;border:1px solid #e2e2e2;border-radius:8px;max-height:34vh;overflow:auto;display:none}
  .results.show{display:block}
  .rrow{padding:10px 12px;font-size:14px;border-bottom:1px solid #eee;color:#222;display:flex;align-items:center;gap:8px}
  .rrow:last-child{border-bottom:0}
  .rrow:active{background:#f0f6ff}
  .rrow .fname{flex:1;min-width:0}
  .rrow .fdel{padding:6px 10px;font-size:13px;border:0;border-radius:6px;background:#ff3b30;color:#fff;flex-shrink:0}
  #map{height:52vh}
  #info{padding:8px 10px;font-size:13px;line-height:1.4}
  .opts{padding:6px 10px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}
  .opts label{font-size:13px;color:#444;display:flex;flex-direction:column}
  .opts input{width:88px;padding:8px;font-size:15px;border:1px solid #ccc;border-radius:6px;margin-top:2px}
  #savebtn{padding:11px 20px;font-size:16px;border:0;border-radius:8px;background:#34c759;color:#fff;font-weight:600}
  #restorebtn{padding:11px 16px;font-size:15px;border:0;border-radius:8px;background:#8e8e93;color:#fff}
  #favadd,#favlistbtn{padding:11px 14px;font-size:15px;border:0;border-radius:8px;background:#5856d6;color:#fff}
  .toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,.85);color:#fff;padding:10px 16px;border-radius:8px;
    font-size:14px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:9999}
  .toast.show{opacity:1}
</style>
</head>
<body>
<div class="bar">
  <input id="q" placeholder="搜地名，回车列出候选（只预览，不改定位）">
  <button id="locatebtn" disabled>当前位置</button>
  <button id="btn">搜</button>
</div>
<div class="results" id="results"></div>
<div class="bar">
  <input id="sharelink" aria-label="地图分享链接" placeholder="粘贴苹果地图或高德分享链接">
  <select id="shareDatum" aria-label="分享坐标类型"><option value="auto">自动识别</option><option value="wgs84">原始 WGS84</option><option value="gcj02">原始 GCJ02</option></select>
  <button id="parsebtn" onclick="parseShare()">解析预览</button>
</div>
<p style="margin:8px;font-size:13px;line-height:1.6">保存到服务器后，等待 Loon 刷新配置，再手动关闭并开启系统定位服务，打开地图验证。保存成功不代表手机已生效。</p>
<div id="map"></div>
<div id="info">加载中…</div>
<div class="opts">
  <label>海拔(米)<input id="alt" type="number" inputmode="numeric"></label>
  <label>水平精度<input id="hacc" type="number" inputmode="numeric"></label>
  <label>垂直精度<input id="vacc" type="number" inputmode="numeric"></label>
  <button id="savebtn">保存定位</button>
  <button id="restorebtn">停止修改</button>
  <button id="favadd">收藏此点</button>
  <button id="favlistbtn">我的收藏</button>
</div>
<div class="results" id="favs"></div>
<p style="margin:8px;font-size:12px"><a href="https://github.com/TIKTOOOO/loon/tree/main/location-spoofer/source" target="_blank" rel="noopener noreferrer">源码与 AGPL-3.0 许可</a></p>
<div class="toast" id="toast"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"><\/script>
<script>
var token = new URLSearchParams(location.search).get("token") || "";
function parseShare(){
  var b=document.getElementById("parsebtn"); b.disabled=true;
  fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
    body:JSON.stringify({text:document.getElementById("sharelink").value,datum:document.getElementById("shareDatum").value})})
    .then(function(r){return r.json();}).then(function(d){
      if(!d.ok)throw new Error(d.error||"解析失败");
      WGS={lat:d.latitude,lng:d.longitude}; saved=false;
      var p=dispPos(); marker.setLatLng(p); map.setView(p,16); info();
      toast("已解析预览，请核对图钉，再点保存定位");
    }).catch(function(e){toast(e.message);}).finally(function(){b.disabled=false;});
}

var GCJ = (function(){
  var PI = Math.PI, a = 6378245.0, ee = 0.00669342162296594323;
  function outOfChina(lat,lng){return (lng<72.004||lng>137.8347)||(lat<0.8293||lat>55.8271);}
  function tLat(x,y){
    var r=-100.0+2.0*x+3.0*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x));
    r+=(20.0*Math.sin(6.0*x*PI)+20.0*Math.sin(2.0*x*PI))*2.0/3.0;
    r+=(20.0*Math.sin(y*PI)+40.0*Math.sin(y/3.0*PI))*2.0/3.0;
    r+=(160.0*Math.sin(y/12.0*PI)+320*Math.sin(y*PI/30.0))*2.0/3.0;return r;
  }
  function tLng(x,y){
    var r=300.0+x+2.0*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x));
    r+=(20.0*Math.sin(6.0*x*PI)+20.0*Math.sin(2.0*x*PI))*2.0/3.0;
    r+=(20.0*Math.sin(x*PI)+40.0*Math.sin(x/3.0*PI))*2.0/3.0;
    r+=(150.0*Math.sin(x/12.0*PI)+300*Math.sin(x/30.0*PI))*2.0/3.0;return r;
  }
  function wgs2gcj(lat,lng){
    if(outOfChina(lat,lng))return [lat,lng];
    var dLat=tLat(lng-105.0,lat-35.0), dLng=tLng(lng-105.0,lat-35.0);
    var radLat=lat/180.0*PI, m=Math.sin(radLat); m=1-ee*m*m; var sm=Math.sqrt(m);
    dLat=(dLat*180.0)/((a*(1-ee))/(m*sm)*PI);
    dLng=(dLng*180.0)/(a/sm*Math.cos(radLat)*PI);
    return [lat+dLat,lng+dLng];
  }
  function gcj2wgs(lat,lng){ // 迭代反解，往返误差 <0.001 米
    if(outOfChina(lat,lng))return [lat,lng];
    var wlat=lat, wlng=lng;
    for(var i=0;i<3;i++){ var g=wgs2gcj(wlat,wlng); wlat+=lat-g[0]; wlng+=lng-g[1]; }
    return [wlat,wlng];
  }
  return {wgs2gcj:wgs2gcj, gcj2wgs:gcj2wgs};
})();

var map, marker;
var WGS = {lat:0, lng:0};
var datum = "gcj";
var saved = true;
var enabledState = true;  // true=伪造中；false=已恢复真实定位（脚本放行）

function $(id){return document.getElementById(id);}
function toast(t){var e=$("toast");e.textContent=t;e.classList.add("show");setTimeout(function(){e.classList.remove("show");},1800);}
function numOrNull(id){var v=$(id).value.trim();return v===""?null:Number(v);}
// Leaflet 在重复世界地图上可能返回 -239 这类经度，需要归一化。
function wrapLng(lng){return ((((Number(lng)+180)%360)+360)%360)-180;}

function setLocateBusy(busy){
  var b=$("locatebtn");
  b.disabled=!!busy;
  b.textContent=busy?"定位中…":"当前位置";
}

function geolocationErrorMessage(err){
  if(err&&err.code===1)return "定位权限被拒绝，请在 Safari 设置中允许定位";
  if(err&&err.code===2)return "暂时无法获取当前位置";
  if(err&&err.code===3)return "获取当前位置超时，请到开阔处重试";
  return "获取当前位置失败";
}

var FAV_KEY="lp_favs_v1";
var FAV_MAX=12;
function loadFavs(){
  try{
    var raw=localStorage.getItem(FAV_KEY);
    var a=raw?JSON.parse(raw):[];
    return Array.isArray(a)?a:[];
  }catch(e){return [];}
}
function saveFavs(list){
  try{localStorage.setItem(FAV_KEY,JSON.stringify(list.slice(0,FAV_MAX)));}catch(e){}
}
function applyFavorite(it){
  var lat=Number(it.lat), lng=wrapLng(it.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)){toast("收藏坐标无效");return;}
  WGS={lat:lat,lng:lng};
  saved=false;
  if(it.alt!=null&&it.alt!=="")$("alt").value=it.alt;
  if(it.hacc!=null&&it.hacc!=="")$("hacc").value=it.hacc;
  if(it.vacc!=null&&it.vacc!=="")$("vacc").value=it.vacc;
  var p=dispPos();
  marker.setLatLng(p);
  map.setView(p,15);
  info();
  toast("已加载收藏，确认后保存");
}
function renderFavs(){
  var box=$("favs");
  var list=loadFavs();
  box.innerHTML="";
  if(!list.length){box.classList.remove("show");return;}
  list.forEach(function(it,idx){
    var row=document.createElement("div");
    row.className="rrow";
    var name=document.createElement("span");
    name.className="fname";
    name.textContent=it.name||(Number(it.lat).toFixed(4)+","+Number(it.lng).toFixed(4));
    name.addEventListener("click",function(){
      $("results").classList.remove("show");
      applyFavorite(it);
    });
    var del=document.createElement("button");
    del.className="fdel";
    del.type="button";
    del.textContent="删";
    del.addEventListener("click",function(e){
      e.stopPropagation();
      var next=loadFavs();
      next.splice(idx,1);
      saveFavs(next);
      if(next.length)renderFavs();else{box.innerHTML="";box.classList.remove("show");}
      toast("已删除收藏");
    });
    row.appendChild(name);
    row.appendChild(del);
    box.appendChild(row);
  });
  box.classList.add("show");
}
function addFavorite(){
  if(!Number.isFinite(WGS.lat)||!Number.isFinite(WGS.lng)){toast("当前坐标无效");return;}
  var def=$("q").value.trim()||(WGS.lat.toFixed(4)+","+WGS.lng.toFixed(4));
  var name=window.prompt("收藏名称",def);
  if(name===null)return;
  name=String(name).trim()||def;
  var list=loadFavs().filter(function(it){
    return Math.abs(Number(it.lat)-WGS.lat)>1e-5||Math.abs(Number(it.lng)-WGS.lng)>1e-5;
  });
  list.unshift({
    name:name,
    lat:WGS.lat,
    lng:WGS.lng,
    alt:numOrNull("alt"),
    hacc:numOrNull("hacc"),
    vacc:numOrNull("vacc"),
    ts:Date.now()
  });
  saveFavs(list);
  renderFavs();
  toast("已收藏");
}
function toggleFavs(){
  var box=$("favs");
  if(box.classList.contains("show")){box.classList.remove("show");return;}
  $("results").classList.remove("show");
  if(!loadFavs().length){toast("暂无收藏");return;}
  renderFavs();
}

function info(){
  if(!enabledState){
    $("info").textContent = (saved ? "服务器状态：停止修改" : "预览未保存") + " · WGS84 " + WGS.lat.toFixed(6) + ", " + WGS.lng.toFixed(6) + "；不代表手机已恢复真实位置";
    return;
  }
  var tag = saved ? "已保存 ✓" : "未保存 · 点“保存定位”生效";
  $("info").innerHTML = "<b style='color:"+(saved?"#34c759":"#ff9500")+"'>"+tag+"</b>　WGS-84 "+
    WGS.lat.toFixed(5)+", "+WGS.lng.toFixed(5)+"　海拔 "+($("alt").value||"?")+"m";
}

// 切换按钮外观：伪造中(灰按钮“恢复真实定位”) / 已恢复(橙按钮“重新开启伪造”)
function updateEnabledUI(){
  var b=$("restorebtn");
  if(enabledState){ b.textContent="停止修改"; b.style.background="#8e8e93"; }
  else { b.textContent="● 重新开启伪造"; b.style.background="#ff9500"; }
  info();
}

// 一键切换 伪造/恢复真实
function toggleEnabled(){
  var want = !enabledState;
  fetch("/enable?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:want})})
    .then(function(r){
      if(r.ok){ enabledState=want; updateEnabledUI();
        toast(want ? "服务器已开启，等待 Loon 刷新后手动关开定位验证" : "服务器已停止修改，等待 Loon 刷新后重新获取真实定位"); }
      else toast("切换失败 "+r.status);
    })
    .catch(function(){ toast("网络错误"); });
}

function dispPos(){return datum==="gcj"?GCJ.wgs2gcj(WGS.lat,WGS.lng):[WGS.lat,WGS.lng];}
function toWgs(lat,lng){lng=wrapLng(lng);return datum==="gcj"?GCJ.gcj2wgs(lat,lng):[lat,lng];}

function fetchElevation(lat,lng){
  lng=wrapLng(lng);
  return fetch("https://api.open-meteo.com/v1/elevation?latitude="+lat+"&longitude="+lng)
    .then(function(r){return r.json();})
    .then(function(d){return (d&&d.elevation&&d.elevation.length)?d.elevation[0]:null;})
    .catch(function(){return null;});
}

function movePin(dispLat,dispLng){
  dispLng=wrapLng(dispLng);
  var w=toWgs(dispLat,dispLng);
  WGS={lat:w[0], lng:wrapLng(w[1])};
  saved=false;
  marker.setLatLng([dispLat,dispLng]);
  info();
  fetchElevation(WGS.lat,WGS.lng).then(function(el){ if(el!==null)$("alt").value=Math.round(el); info(); });
}

function commit(){
  var payload={lat:WGS.lat, lng:WGS.lng,
    altitude:numOrNull("alt"), horizontalAccuracy:numOrNull("hacc"), verticalAccuracy:numOrNull("vacc")};
  fetch("/set?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
    .then(function(r){ if(r.ok){ saved=true; enabledState=true; updateEnabledUI(); toast("服务器已保存；等待 Loon 刷新，再关开定位验证"); } else { toast("保存失败 "+r.status); } })
    .catch(function(){ toast("网络错误"); });
}

function locateCurrent(){
  if(enabledState){
    toast("请先恢复真实定位并刷新定位服务");
    return;
  }
  if(!navigator.geolocation){
    toast("当前浏览器不支持定位");
    return;
  }

  setLocateBusy(true);
  navigator.geolocation.getCurrentPosition(
    function(pos){
      var lat=Number(pos&&pos.coords&&pos.coords.latitude);
      var lng=wrapLng(pos&&pos.coords&&pos.coords.longitude);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)){
        toast("获取当前位置失败");
        setLocateBusy(false);
        return;
      }

      WGS={lat:lat,lng:lng};
      saved=false;
      var p=dispPos();
      marker.setLatLng(p);
      map.setView(p,16);
      info();
      fetchElevation(WGS.lat,WGS.lng).then(function(el){
        if(el!==null)$("alt").value=Math.round(el);
        info();
      });
      toast("已定位到当前位置，请确认后保存");
      setLocateBusy(false);
    },
    function(err){
      toast(geolocationErrorMessage(err));
      setLocateBusy(false);
    },
    {enableHighAccuracy:true,maximumAge:0,timeout:12000}
  );
}

function search(){
  var q=$("q").value.trim(); if(!q) return;
  fetch("https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=8&q="+encodeURIComponent(q))
    .then(function(r){return r.json();})
    .then(function(a){
      var box=$("results"); box.innerHTML="";
      if(!a||!a.length){ box.classList.remove("show"); toast("没找到"); return; }
      a.forEach(function(it){
        var row=document.createElement("div");
        row.className="rrow";
        row.textContent=it.display_name;
        row.addEventListener("click",function(){
          box.classList.remove("show"); box.innerHTML="";
          var la=+it.lat, lo=+it.lon;
          var p = datum==="gcj"?GCJ.wgs2gcj(la,lo):[la,lo];
          map.setView(p,15);
          toast("已定位视野，在地图上点一下放置图钉");
        });
        box.appendChild(row);
      });
      box.classList.add("show");
    })
    .catch(function(){toast("搜索失败");});
}

function load(){
  fetch("/loc.json?token="+encodeURIComponent(token)).then(function(r){if(!r.ok)throw new Error("读取配置失败 "+r.status);return r.json();}).then(function(d){
    WGS={lat:d.latitude, lng:d.longitude};
    saved=true;
    enabledState=(d.enabled!==false);
    $("alt").value=(d.altitude!==undefined?d.altitude:"");
    $("hacc").value=(d.horizontalAccuracy!==undefined?d.horizontalAccuracy:39);
    $("vacc").value=(d.verticalAccuracy!==undefined?d.verticalAccuracy:1000);

    var amapVec=L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=7",{subdomains:"1234",maxZoom:18,attribution:"高德地图"});
    amapVec.datum="gcj";
    var amapSat=L.layerGroup([
      L.tileLayer("https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",{subdomains:"1234",maxZoom:18}),
      L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=8",{subdomains:"1234",maxZoom:18})
    ]);
    amapSat.datum="gcj";
    var osm=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
    osm.datum="wgs";

    map=L.map("map");
    if(WGS.lng<72.004||WGS.lng>137.8347||WGS.lat<0.8293||WGS.lat>55.8271){osm.addTo(map);datum="wgs";}
    else{amapVec.addTo(map);datum="gcj";}
    map.setView(dispPos(),13);
    L.control.layers({"高德地图":amapVec,"高德卫星":amapSat,"国外 OSM":osm},null,{collapsed:false}).addTo(map);

    marker=L.marker(dispPos(),{draggable:true}).addTo(map);
    updateEnabledUI();
    setLocateBusy(false);

    map.on("baselayerchange",function(e){datum=e.layer.datum||"wgs"; var p=dispPos(); marker.setLatLng(p); map.setView(p,map.getZoom()); info();});
    map.on("click",function(e){movePin(e.latlng.lat,e.latlng.lng);});
    marker.on("dragend",function(){var p=marker.getLatLng(); movePin(p.lat,p.lng);});
  }).catch(function(){$("info").textContent="加载失败，检查 token 是否正确";});
}

$("btn").addEventListener("click",search);
$("q").addEventListener("keydown",function(e){if(e.key==="Enter")search();});
$("locatebtn").addEventListener("click",locateCurrent);
$("savebtn").addEventListener("click",commit);
$("restorebtn").addEventListener("click",toggleEnabled);
$("favadd").addEventListener("click",addFavorite);
$("favlistbtn").addEventListener("click",toggleFavs);
load();
<\/script>
</body>
</html>`;

// location-picker/worker/src/vendor/wloc-parse.js
function safeDecode(s) {
  if (!s) return "";
  try {
    return decodeURIComponent(String(s).replace(/\+/g, " "));
  } catch (e) {
    return String(s);
  }
}
function extractFromString(s, opts) {
  const hit = extractRaw(s, opts);
  return hit && inRange(hit.lat, hit.lon) ? hit : null;
}
function inRange(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}
function extractRaw(s, opts) {
  if (!s) return null;
  const allowBare = !opts || opts.allowBare !== false;
  const str = String(s);
  let m;
  m = str.match(/(?:^|[?&])(?:coordinate|ll|sll)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i);
  if (m) return { lat: +m[1], lon: +m[2], name: queryName(str), src: "apple" };
  m = str.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (m) return { lat: +m[1], lon: +m[2], name: googleName(str), src: "google" };
  m = str.match(
    /[?&]p=[^,&%]*(?:,|%2C)(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)(?:(?:,|%2C)((?:(?!,|%2C|&).)+))?/i
  );
  if (m) return { lat: +m[1], lon: +m[2], name: m[3] ? safeDecode(m[3]) : "", src: "amap" };
  m = str.match(
    /[?&]q=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)(?:(?:,|%2C)((?:(?!,|%2C|&).)+))?/i
  );
  if (m) return { lat: +m[1], lon: +m[2], name: m[3] ? safeDecode(m[3]) : "", src: "amap" };
  m = str.match(/(?:^|[?&])(?:lnglat|position)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i);
  if (m) return { lat: +m[2], lon: +m[1], name: queryName(str), src: "amap" };
  m = str.match(/baidu\.com\/[^\s]*?@(-?\d{6,9}(?:\.\d+)?)(?:,|%2C)(-?\d{6,9}(?:\.\d+)?)/i);
  if (m) {
    const bd = bd09mcToBd09(+m[1], +m[2]);
    if (bd) return { lat: bd.lat, lon: bd.lon, name: baiduPathName(str), src: "baidu" };
  }
  m = str.match(/\/maps\/[^\s]*@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: +m[1], lon: +m[2], name: googleName(str), src: "google" };
  if (allowBare) {
    m = str.match(/(-?\d{1,3}\.\d{4,})\s*(?:,|%2C)\s*(-?\d{1,3}\.\d{4,})/);
    if (m) return { lat: +m[1], lon: +m[2], name: "", src: "text" };
  }
  return null;
}
function queryName(str) {
  const m = str.match(/[?&]name=([^&]+)/i);
  return m ? safeDecode(m[1]) : "";
}
function baiduPathName(str) {
  const m = str.match(/\/poi\/([^/@?]+)/);
  return m ? safeDecode(m[1]).trim() : "";
}
function googleName(str) {
  const m = str.match(/\/maps\/place\/([^/@?]+)/);
  return m ? safeDecode(m[1]).replace(/\+/g, " ").trim() : "";
}
var MAX_BODY_BYTES = 512 * 1024;
function round6(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}
var MCBAND = [1289059486e-2, 836237787e-2, 5591021, 348198983e-2, 167804312e-2, 0];
var MC2LL = [
  [1410526172116255e-23, 898305509648872e-20, -1.9939833816331, 200.9824383106796, -187.2403703815547, 91.6087516669843, -23.38765649603339, 2.57121317296198, -0.03801003308653, 173379812e-1],
  [-7435856389565537e-24, 8983055097726239e-21, -0.78625201886289, 96.32687599759846, -1.85204757529826, -59.36935905485877, 47.40033549296737, -16.50741931063887, 2.28786674699375, 1026014486e-2],
  [-3030883460898826e-23, 898305509983578e-20, 0.30071316287616, 59.74293618442277, 7.357984074871, -25.38371002664745, 13.45380521110908, -3.29883767235584, 0.32710905363475, 685681737e-2],
  [-1981981304930552e-23, 8983055099779535e-21, 0.03278182852591, 40.31678527705744, 0.65659298677277, -4.44255534477492, 0.85341911805263, 0.12923347998204, -0.04625736007561, 448277706e-2],
  [309191371068437e-23, 8983055096812155e-21, 6995724062e-14, 23.10934304144901, -23663490511e-14, -0.6321817810242, -0.00663494467273, 0.03430082397953, -0.00466043876332, 25551644e-1],
  [2890871144776878e-24, 8983055095805407e-21, -3068298e-14, 7.47137025468032, -353937994e-14, -0.02145144861037, -1234426596e-14, 10322952773e-14, -323890364e-14, 826088.5]
];
function bd09mcToBd09(x, y) {
  const ax = Math.abs(x), ay = Math.abs(y);
  let f = null;
  for (let i = 0; i < MCBAND.length; i++) {
    if (ay >= MCBAND[i]) {
      f = MC2LL[i];
      break;
    }
  }
  if (!f) return null;
  const c = ay / f[9];
  let lon = f[0] + f[1] * ax;
  let lat = f[2] + f[3] * c + f[4] * c ** 2 + f[5] * c ** 3 + f[6] * c ** 4 + f[7] * c ** 5 + f[8] * c ** 6;
  lon *= x < 0 ? -1 : 1;
  lat *= y < 0 ? -1 : 1;
  return { lat, lon };
}
var X_PI = Math.PI * 3e3 / 180;
function bd09ToGcj02(lat, lon) {
  const x = lon - 65e-4, y = lat - 6e-3;
  const z = Math.sqrt(x * x + y * y) - 2e-5 * Math.sin(y * X_PI);
  const t = Math.atan2(y, x) - 3e-6 * Math.cos(x * X_PI);
  return { lat: z * Math.sin(t), lon: z * Math.cos(t) };
}
var HK_POLY = [
  [113.8, 22.1],
  [113.8, 22.43],
  [113.9, 22.455],
  [113.98, 22.487],
  [114.05, 22.507],
  [114.11, 22.527],
  [114.17, 22.543],
  [114.24, 22.552],
  [114.32, 22.545],
  [114.5, 22.45],
  [114.5, 22.1]
];
function pointInPoly(lat, lon, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inMacau(lat, lon) {
  return lat >= 22.1 && lat <= 22.215 && lon >= 113.525 && lon <= 113.605;
}
function inTaiwan(lat, lon) {
  return lat >= 21.85 && lat <= 25.35 && lon >= 119.3 && lon <= 122.1;
}
function usesWgs84Locally(lat, lon, src) {
  if (src !== "apple" && src !== "google") return false;
  return inMacau(lat, lon) || inTaiwan(lat, lon) || pointInPoly(lat, lon, HK_POLY);
}
function toWgs84(lat, lon, src) {
  if (src === "baidu") {
    const g = bd09ToGcj02(lat, lon);
    return gcj02ToWgs84(g.lat, g.lon);
  }
  if (src === "amap" || src === "apple" || src === "google") {
    if (usesWgs84Locally(lat, lon, src)) return { lat, lon };
    return gcj02ToWgs84(lat, lon);
  }
  return { lat, lon };
}
var GCJ_A = 6378245;
var GCJ_EE = 0.006693421622965943;
function gcjOutOfChina(lng, la) {
  return lng < 72.004 || lng > 137.8347 || la < 0.8293 || la > 55.8271;
}
function gcjDeltaLat(x, y) {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return r;
}
function gcjDeltaLon(x, y) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return r;
}
function wgs84ToGcj02(lat, lon) {
  if (gcjOutOfChina(lon, lat)) return { lat, lon };
  let dLat = gcjDeltaLat(lon - 105, lat - 35);
  let dLon = gcjDeltaLon(lon - 105, lat - 35);
  const radLat = lat / 180 * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = dLat * 180 / (GCJ_A * (1 - GCJ_EE) / (magic * sqrtMagic) * Math.PI);
  dLon = dLon * 180 / (GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lon: lon + dLon };
}
function gcj02ToWgs84(lat, lon) {
  if (gcjOutOfChina(lon, lat)) return { lat, lon };
  let wgsLat = lat;
  let wgsLon = lon;
  for (let i = 0; i < 6; i++) {
    const g = wgs84ToGcj02(wgsLat, wgsLon);
    const errLat = g.lat - lat;
    const errLon = g.lon - lon;
    if (Math.abs(errLat) < 1e-9 && Math.abs(errLon) < 1e-9) break;
    wgsLat -= errLat;
    wgsLon -= errLon;
  }
  return { lat: wgsLat, lon: wgsLon };
}

// location-picker/worker/src/parse.js
var HOSTS = /* @__PURE__ */ new Map([
  ["maps.apple.com", "apple"],
  ["maps.apple", "apple"],
  ["amap.com", "amap"],
  ["www.amap.com", "amap"],
  ["uri.amap.com", "amap"],
  ["ditu.amap.com", "amap"],
  ["surl.amap.com", "amap"],
  ["m.amap.com", "amap"]
]);
function checkedUrl(value, base) {
  let u;
  try {
    u = new URL(value, base);
  } catch {
    throw new Error("无效地图链接");
  }
  if (!HOSTS.has(u.hostname) || !["http:", "https:"].includes(u.protocol) || u.username || u.password || u.port && u.port !== "443" && u.port !== "80") {
    throw new Error("仅支持苹果地图或高德地图的官方分享链接");
  }
  u.protocol = "https:";
  u.port = "";
  return u;
}
function extract(u) {
  const source = HOSTS.get(u.hostname);
  const copy = new URL(u);
  copy.searchParams.delete("sll");
  const hit = extractFromString(copy.href, { allowBare: false });
  if (!hit || hit.src !== source) return null;
  return { ...hit, src: source, name: hit.name || u.searchParams.get("q") || "地图选点" };
}
async function cappedText(response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > 256 * 1024) throw new Error("地图页面过大，请改用带坐标的分享链接");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {
    });
  }
}
function fromBody(body2, current) {
  const text = body2.replace(/&amp;/g, "&").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  for (const candidate of text.match(/https?:\/\/[^\s"'<>]+/g) || []) {
    try {
      const url = checkedUrl(candidate);
      if (HOSTS.get(url.hostname) !== HOSTS.get(current.hostname)) continue;
      const hit = extract(url);
      if (hit) return hit;
    } catch {
    }
  }
  return null;
}
async function parseMap(text, datum = "auto", fetcher = fetch) {
  if (typeof text !== "string" || text.length > 8192) throw new Error("分享内容为空或过长");
  if (!["auto", "wgs84", "gcj02"].includes(datum)) throw new Error("未知坐标类型");
  const value = text.match(/https?:\/\/[^\s"'<>，。；）)]+/i)?.[0];
  if (!value) throw new Error("请从苹果地图或高德地图分享地点链接");
  let current = checkedUrl(value), hit = extract(current);
  const signal = AbortSignal.timeout(8e3);
  for (let redirects = 0; !hit && redirects <= 4; redirects++) {
    const response = await fetcher(current.href, {
      redirect: "manual",
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 4) throw new Error("地图链接跳转次数过多");
      current = checkedUrl(location, current);
      hit = extract(current);
    } else {
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("地图服务暂时不可用");
      }
      hit = fromBody(await cappedText(response), current);
      break;
    }
  }
  if (!hit) throw new Error("无法确定所选地点坐标，请用网页选点或分享带坐标的链接");
  const point = datum === "wgs84" ? hit : toWgs84(hit.lat, hit.lon, datum === "gcj02" ? "amap" : hit.src);
  return {
    name: String(hit.name).slice(0, 200),
    source: hit.src,
    latitude: round6(point.lat),
    longitude: round6(point.lon),
    datum: "wgs84",
    inputDatum: datum,
    notice: "自动转换遵循地图来源及地区规则；边界附近或位置有偏移时请在网页核对，勿重复转换。"
  };
}

// location-picker/worker/src/app.js
var DEFAULT = {
  enabled: false,
  latitude: 37.3349,
  longitude: -122.00902,
  altitude: 530,
  horizontalAccuracy: 39,
  verticalAccuracy: 1e3
};
var headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "origin",
  "X-Content-Type-Options": "nosniff"
};
var csp = "default-src 'none'; script-src https://unpkg.com 'unsafe-inline'; style-src https://unpkg.com 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https://api.open-meteo.com https://nominatim.openstreetmap.org; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
var json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
});
function authenticated(request, env) {
  const provided = request.headers.get("Authorization")?.replace(/^Bearer /, "") || new URL(request.url).searchParams.get("token") || "";
  if (!env.TOKEN || !provided) return false;
  const a = new TextEncoder().encode(provided), b = new TextEncoder().encode(env.TOKEN);
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("请求正文不能为空");
  let size = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1e4) throw Error("请求内容过长");
      text += decoder.decode(part.value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {
    });
  }
  const parsed = JSON.parse(text + decoder.decode());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("请求格式错误");
  return parsed;
}
var validNumber = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
async function readLoc(env) {
  const stored = await env.LOC_KV.get("loc");
  if (!stored) return { ...DEFAULT };
  const loc = JSON.parse(stored);
  if (!loc || typeof loc.enabled !== "boolean" || !validNumber(loc.latitude, -90, 90) || !validNumber(loc.longitude, -180, 180)) throw Error("Invalid stored config");
  return loc;
}
var app_default = {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET") return json({
      ok: !!env.LOC_KV && !!env.TOKEN,
      kv: !!env.LOC_KV,
      tokenConfigured: !!env.TOKEN
    });
    if (!env.TOKEN || !env.LOC_KV) return json({ ok: false, error: "服务器尚未配置 TOKEN 或 LOC_KV" }, 503);
    if (!authenticated(request, env)) return json({ ok: false, error: "访问口令错误" }, 403);
    if (path === "/" && request.method === "GET") return new Response(PAGE, {
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": csp }
    });
    if (path === "/favicon.ico") return new Response(null, { status: 204, headers });
    if (path === "/loc.json" && request.method === "GET") {
      try {
        return json(await readLoc(env));
      } catch {
        return json({ ok: false, error: "配置读取失败，请稍后再试" }, 503);
      }
    }
    if (request.method !== "POST" || !["/set", "/enable", "/api/parse"].includes(path)) return json({ ok: false, error: "接口或请求方式不存在" }, 404);
    let data;
    try {
      data = await body(request);
    } catch {
      return json({ ok: false, error: "请求必须是有效 JSON 且不超过 10KB" }, 400);
    }
    if (path === "/api/parse") {
      try {
        return json({ ok: true, ...await parseMap(data.text, data.datum || "auto") });
      } catch (error) {
        const message = error.name === "TimeoutError" || error.name === "AbortError" ? "地图链接解析超时，请重试" : error.message;
        return json({ ok: false, error: message }, 422);
      }
    }
    if (path === "/set" && (!validNumber(data.lat, -90, 90) || !validNumber(data.lng, -180, 180))) return json({ ok: false, error: "经纬度必须是有效数字，纬度 ±90，经度 ±180" }, 400);
    if (path === "/enable" && typeof data.enabled !== "boolean") return json({ ok: false, error: "enabled 必须是布尔值" }, 400);
    for (const [key, min, max] of [["altitude", -12e3, 1e5], ["horizontalAccuracy", 1, 1e5], ["verticalAccuracy", 1, 1e5]]) {
      if (data[key] != null && !validNumber(data[key], min, max)) return json({ ok: false, error: key + " 超出有效范围" }, 400);
    }
    try {
      const loc = await readLoc(env);
      if (path === "/set") {
        Object.assign(loc, { enabled: true, latitude: data.lat, longitude: data.lng });
        for (const key of ["altitude", "horizontalAccuracy", "verticalAccuracy"]) if (data[key] != null) loc[key] = Math.round(data[key]);
      } else loc.enabled = data.enabled;
      loc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      loc.revision = crypto.randomUUID();
      await env.LOC_KV.put("loc", JSON.stringify(loc));
      return json({ ...loc, ok: true, status: "saved", notice: "服务器已保存；等待 Loon 刷新配置后手动关开定位服务，再验证地图。" });
    } catch {
      return json({ ok: false, error: "配置存储失败，未确认保存，请勿当作成功" }, 503);
    }
  }
};
export {
  app_default as default
};
