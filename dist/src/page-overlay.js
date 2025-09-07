(function(){"use strict";(function(){if(window.__ES_PAGE_OVERLAY_ACTIVE__)return;window.__ES_PAGE_OVERLAY_ACTIVE__=!0;let u=new Map,p={vars:{},sites:{},profiles:{}},f=!1,d=null,g=[],v=!1;const A=`
        .es-copy-indicator {
            position: absolute !important;
            background: linear-gradient(135deg, #4f8cff 0%, #6aa0ff 100%) !important;
            color: white !important;
            border: none !important;
            border-radius: 50% !important;
            padding: 4px !important;
            font-size: 10px !important;
            font-family: system-ui, sans-serif !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            z-index: 2147483646 !important;
            box-shadow: 0 1px 4px rgba(79,140,255,0.4) !important;
            transition: all 0.2s ease !important;
            pointer-events: auto !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 20px !important;
            height: 20px !important;
            backdrop-filter: blur(8px) !important;
        }
        
        .es-copy-indicator:hover {
            transform: scale(1.1) !important;
            box-shadow: 0 2px 8px rgba(79,140,255,0.5) !important;
        }
        
        .es-paste-button {
            position: absolute !important;
            background: linear-gradient(135deg, #34c759 0%, #30d158 100%) !important;
            color: white !important;
            border: none !important;
            border-radius: 12px !important;
            padding: 4px 8px !important;
            font-size: 11px !important;
            font-family: system-ui, sans-serif !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            z-index: 2147483646 !important;
            box-shadow: 0 2px 8px rgba(52,199,89,0.3) !important;
            transition: all 0.2s ease !important;
            pointer-events: auto !important;
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            white-space: nowrap !important;
            backdrop-filter: blur(8px) !important;
        }
        
        .es-paste-button:hover {
            transform: scale(1.05) !important;
            box-shadow: 0 4px 12px rgba(52,199,89,0.4) !important;
        }
        
        .es-element-highlight {
            outline: 1px solid #4f8cff !important;
            outline-offset: 0px !important;
            border-radius: 2px !important;
            background: rgba(79,140,255,0.02) !important;
        }
        
        .es-paste-highlight {
            outline: 1px solid #34c759 !important;
            outline-offset: 0px !important;
            border-radius: 2px !important;
            background: rgba(52,199,89,0.02) !important;
        }
        
        .es-notification {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: rgba(17,17,17,0.95) !important;
            color: white !important;
            padding: 12px 16px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-family: system-ui, sans-serif !important;
            z-index: 2147483647 !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
            backdrop-filter: blur(12px) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            animation: esSlideIn 0.3s ease-out !important;
        }
        
        @keyframes esSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes esSlideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        .es-floating-window {
            position: fixed !important;
            top: 100px !important;
            right: 20px !important;
            width: 240px !important;
            max-height: 350px !important;
            background: rgba(17,17,17,0.95) !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            border-radius: 8px !important;
            box-shadow: 0 6px 24px rgba(0,0,0,0.3) !important;
            backdrop-filter: blur(12px) !important;
            z-index: 2147483645 !important;
            font-family: system-ui, sans-serif !important;
            color: white !important;
            resize: both !important;
            overflow: hidden !important;
        }
        
        .es-floating-header {
            padding: 8px 12px !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            cursor: move !important;
            background: rgba(79,140,255,0.08) !important;
        }
        
        .es-floating-title {
            font-size: 12px !important;
            font-weight: 600 !important;
            margin: 0 !important;
        }
        
        .es-floating-close {
            background: none !important;
            border: none !important;
            color: white !important;
            cursor: pointer !important;
            font-size: 14px !important;
            padding: 2px !important;
            border-radius: 3px !important;
            opacity: 0.7 !important;
            line-height: 1 !important;
        }
        
        .es-floating-close:hover {
            background: rgba(255,255,255,0.1) !important;
            opacity: 1 !important;
        }
        
        .es-floating-content {
            padding: 8px !important;
            max-height: 280px !important;
            overflow-y: auto !important;
        }
        
        .es-var-item {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 6px 0 !important;
            border-bottom: 1px solid rgba(255,255,255,0.04) !important;
        }
        
        .es-var-info {
            flex: 1 !important;
            min-width: 0 !important;
        }
        
        .es-var-name {
            font-size: 11px !important;
            font-weight: 500 !important;
            color: #4f8cff !important;
            margin-bottom: 1px !important;
        }
        
        .es-var-value {
            font-size: 10px !important;
            color: rgba(255,255,255,0.6) !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        
        .es-var-copy {
            background: linear-gradient(135deg, #34c759 0%, #30d158 100%) !important;
            color: white !important;
            border: none !important;
            border-radius: 4px !important;
            padding: 3px 6px !important;
            font-size: 9px !important;
            cursor: pointer !important;
            margin-left: 6px !important;
            display: flex !important;
            align-items: center !important;
            gap: 2px !important;
            transition: all 0.2s ease !important;
        }
        
        .es-var-copy:hover {
            transform: scale(1.05) !important;
            box-shadow: 0 2px 8px rgba(52,199,89,0.3) !important;
        }
        
        .es-recent-section {
            margin-top: 8px !important;
            padding-top: 8px !important;
            border-top: 1px solid rgba(255,255,255,0.08) !important;
        }
        
        .es-section-title {
            font-size: 10px !important;
            font-weight: 600 !important;
            color: rgba(255,255,255,0.7) !important;
            margin-bottom: 6px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.3px !important;
        }
    `,z=document.createElement("style");z.textContent=A,document.head.appendChild(z);function m(t,o=2e3){const i=document.createElement("div");i.className="es-notification",i.textContent=t,document.body.appendChild(i),setTimeout(()=>{i.style.animation="esSlideOut 0.3s ease-out forwards",setTimeout(()=>i.remove(),300)},o)}const E="es-floating-window-state",y="es-main-tab-id",_=Math.random().toString(36).substr(2,9);function T(){const t=localStorage.getItem(y);(!t||t===_)&&(localStorage.setItem(y,_),v=!0)}function S(t){if(!t)return;const o=t.getBoundingClientRect(),i={visible:!0,left:t.style.left||o.left+"px",top:t.style.top||o.top+"px",width:t.style.width||"240px",height:t.style.height||"auto",timestamp:Date.now()};localStorage.setItem(E,JSON.stringify(i))}function I(){try{const t=localStorage.getItem(E);return t?JSON.parse(t):null}catch{return null}}function L(){if(d)return d;const t=document.createElement("div");t.className="es-floating-window",t.innerHTML=`
            <div class="es-floating-header">
                <h3 class="es-floating-title">Variables</h3>
                <button class="es-floating-close">×</button>
            </div>
            <div class="es-floating-content">
                <div class="es-vars-list"></div>
                <div class="es-recent-section">
                    <div class="es-section-title">Recent</div>
                    <div class="es-recent-list"></div>
                </div>
            </div>
        `;const o=I();o&&(t.style.left=o.left,t.style.top=o.top,t.style.right="auto",o.width!=="auto"&&(t.style.width=o.width),o.height!=="auto"&&(t.style.height=o.height));let i=!1,n={x:0,y:0};t.querySelector(".es-floating-header").addEventListener("mousedown",c=>{i=!0;const l=t.getBoundingClientRect();n.x=c.clientX-l.left,n.y=c.clientY-l.top,document.addEventListener("mousemove",a),document.addEventListener("mouseup",r)});function a(c){if(!i)return;const l=c.clientX-n.x,h=c.clientY-n.y;t.style.left=Math.max(0,Math.min(t.innerWidth-t.offsetWidth,l))+"px",t.style.top=Math.max(0,Math.min(t.innerHeight-t.offsetHeight,h))+"px",t.style.right="auto",S(t)}function r(){i=!1,document.removeEventListener("mousemove",a),document.removeEventListener("mouseup",r),S(t)}return new ResizeObserver(()=>{S(t)}).observe(t),t.querySelector(".es-floating-close").addEventListener("click",()=>{t.remove(),d=null,v=!1,localStorage.removeItem(y),localStorage.setItem(E,JSON.stringify({visible:!1,timestamp:Date.now()})),localStorage.setItem("es-floating-window-auto-show","false")}),document.body.appendChild(t),d=t,S(t),t}function b(){if(!d)return;const t=d.querySelector(".es-vars-list"),o=d.querySelector(".es-recent-list");t.innerHTML="",Object.values(p.vars).sort((n,e)=>n.name.localeCompare(e.name)).forEach(n=>{const e=document.createElement("div");e.className="es-var-item",e.innerHTML=`
                <div class="es-var-info">
                    <div class="es-var-name">${x(n.name)}</div>
                    <div class="es-var-value" title="${x(n.value)}">${x(n.value||"No value")}</div>
                </div>
                <button class="es-var-copy" data-var-id="${n.id}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    Copy
                </button>
            `,e.querySelector(".es-var-copy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(n.value),m(`Copied ${n.name} to clipboard`)}catch{const r=document.createElement("textarea");r.value=n.value,document.body.appendChild(r),r.select(),document.execCommand("copy"),document.body.removeChild(r),m(`Copied ${n.name} to clipboard`)}}),t.appendChild(e)}),o.innerHTML="",g.slice(0,3).forEach(n=>{const e=document.createElement("div");e.className="es-var-item",e.innerHTML=`
                <div class="es-var-info">
                    <div class="es-var-name">${x(n.name)}</div>
                    <div class="es-var-value" title="${x(n.newValue)}">${x(n.newValue||"No value")}</div>
                </div>
                <button class="es-var-copy" data-value="${x(n.newValue)}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    Copy
                </button>
            `,e.querySelector(".es-var-copy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(n.newValue),m(`Copied ${n.name} to clipboard`)}catch{const r=document.createElement("textarea");r.value=n.newValue,document.body.appendChild(r),r.select(),document.execCommand("copy"),document.body.removeChild(r),m(`Copied ${n.name} to clipboard`)}}),o.appendChild(e)}),g.length===0&&(o.innerHTML='<div style="font-size: 11px; color: rgba(255,255,255,0.5); font-style: italic;">No recent updates</div>')}function x(t){const o=document.createElement("div");return o.textContent=t,o.innerHTML}function M(t){g=g.filter(o=>o.variableId!==t.variableId),g.unshift({variableId:t.variableId,name:t.variableName,newValue:t.newValue,timestamp:Date.now()}),g=g.slice(0,5),b()}function $(t,o){const i=document.createElement("button");return i.className="es-copy-indicator",i.innerHTML=`
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
        `,i.title=`Copy ${o.name}: "${o.value}"`,i.addEventListener("click",async n=>{var a,r;n.preventDefault(),n.stopPropagation();const e=((a=window.__ES_UTILS__)==null?void 0:a.getElementValue(t))||((r=t.textContent)==null?void 0:r.trim())||"";if(e!==o.value)try{await chrome.runtime.sendMessage({type:"UPDATE_VARIABLE_VALUE",payload:{variableId:o.id,newValue:e}}),m(`Updated ${o.name}: "${e}"`)}catch(s){console.error("Failed to update variable:",s)}else m(`${o.name} is up to date`)}),i}function N(t,o){if(o.length===0)return null;const i=document.createElement("button");if(i.className="es-paste-button",o.length===1){const n=o[0];i.innerHTML=`
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3-1.34 3-3h3v16H6V3h3c0 1.66 1.34 3 3 3z"/>
                </svg>
                ${n.varName||"Paste"}
            `,i.title=`Paste ${n.varName}: "${n.value}"`,i.addEventListener("click",async e=>{var a;e.preventDefault(),e.stopPropagation(),(a=window.__ES_UTILS__)!=null&&a.setElementValue?window.__ES_UTILS__.setElementValue(t,n.value)&&m(`Pasted ${n.varName||"value"}`):(t.value=n.value,t.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new Event("change",{bubbles:!0})),m(`Pasted ${n.varName||"value"}`))})}else i.innerHTML=`
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3-1.34 3-3h3v16H6V3h3c0 1.66 1.34 3 3 3z"/>
                </svg>
                Paste (${o.length})
            `,i.title=`${o.length} paste options available`,i.addEventListener("click",async n=>{n.preventDefault(),n.stopPropagation();const e=document.createElement("div");e.style.cssText=`
                    position: absolute;
                    background: rgba(17,17,17,0.95);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    padding: 8px 0;
                    z-index: 2147483647;
                    backdrop-filter: blur(12px);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    min-width: 150px;
                `,o.forEach(r=>{const s=document.createElement("button");s.style.cssText=`
                        display: block;
                        width: 100%;
                        padding: 8px 12px;
                        background: none;
                        border: none;
                        color: white;
                        text-align: left;
                        cursor: pointer;
                        font-size: 12px;
                        font-family: system-ui, sans-serif;
                    `,s.innerHTML=`
                        <div style="font-weight: 500;">${r.varName||"Value"}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 10px;">"${r.value.substring(0,30)}${r.value.length>30?"...":""}"</div>
                    `,s.addEventListener("mouseenter",()=>{s.style.background="rgba(255,255,255,0.1)"}),s.addEventListener("mouseleave",()=>{s.style.background="none"}),s.addEventListener("click",()=>{var c;(c=window.__ES_UTILS__)!=null&&c.setElementValue?window.__ES_UTILS__.setElementValue(t,r.value):(t.value=r.value,t.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new Event("change",{bubbles:!0}))),m(`Pasted ${r.varName||"value"}`),e.remove()}),e.appendChild(s)});const a=i.getBoundingClientRect();e.style.top=a.bottom+5+"px",e.style.left=a.left+"px",document.body.appendChild(e),setTimeout(()=>{const r=s=>{e.contains(s.target)||(e.remove(),document.removeEventListener("click",r))};document.addEventListener("click",r)},100)});return i}function V(t,o,i="paste"){const n=o.getBoundingClientRect(),e=window.pageXOffset||document.documentElement.scrollLeft,a=window.pageYOffset||document.documentElement.scrollTop;i==="copy"?(t.style.left=n.right+e-10+"px",t.style.top=n.bottom+a-10+"px"):(t.style.left=n.right+e-t.offsetWidth+8+"px",t.style.top=n.top+a-8+"px")}async function w(){if(console.log("updateOverlays called (PROFILE FILTERED), enabled:",f,"data:",p),!f)return;u.forEach(e=>e.remove()),u.clear(),document.querySelectorAll(".es-element-highlight, .es-paste-highlight").forEach(e=>{e.classList.remove("es-element-highlight","es-paste-highlight")});const t=location.href;console.log("Processing variables:",Object.keys(p.vars).length),Object.values(p.vars).forEach(e=>{if(console.log("Processing variable:",e.name,"sourceSelector:",e.sourceSelector,"sourceSiteId:",e.sourceSiteId),e.sourceSelector)try{const a=document.querySelector(e.sourceSelector);if(console.log("Found element for selector:",e.sourceSelector,a),a){let r=!0;if(e.sourceSiteId){const s=p.sites[e.sourceSiteId];console.log("Found site:",s==null?void 0:s.title,"pattern:",s==null?void 0:s.urlPattern),s&&s.urlPattern&&(r=O(s.urlPattern,t),console.log("Site pattern match result:",r))}if(r){a.classList.add("es-element-highlight");const s=$(a,e);document.body.appendChild(s),u.set(a,s),V(s,a,"copy"),console.log("Added copy indicator for:",e.name)}else console.log("Site pattern does not match current URL")}}catch(a){console.warn("Invalid selector:",e.sourceSelector,a)}else console.log("Variable has no sourceSelector:",e.name)}),console.log("Processing profiles for paste buttons...");const o=Object.values(p.profiles).filter(e=>e.sitePattern&&O(e.sitePattern,t));console.log("Found matching profiles:",o.length);const i=new Set,n=new Map;o.forEach(e=>{(e.mappings||e.inputs||[]).forEach(a=>{a.selector&&(i.add(a.selector),n.has(a.selector)||n.set(a.selector,[]),n.get(a.selector).push(a))})}),console.log("Found profiled selectors:",i.size),i.forEach(e=>{try{const a=document.querySelectorAll(e);console.log(`Selector "${e}" matches ${a.length} elements`),a.forEach(r=>{const s=n.get(e),c=[];if(s.forEach(l=>{if(l.varName){const h=Object.values(p.vars).find(P=>P.name===l.varName);h&&h.value&&c.push({selector:l.selector,varName:h.name,value:h.value,priority:"profile"})}else l.value&&c.push({selector:l.selector,varName:"Literal",value:l.value,priority:"profile"})}),c.length>0){r.classList.add("es-paste-highlight");const l=N(r,c);l&&(document.body.appendChild(l),u.set(r,l),V(l,r),console.log(`Added paste button for element matching "${e}"`))}})}catch(a){console.warn("Invalid selector in profile:",e,a)}})}function O(t,o){try{const i=new URL(t.replace("/*","/")),n=new URL(o);if(i.origin!==n.origin)return!1;const a=(t.endsWith("/*")?i.pathname:t.replace(i.origin,"")).replace(/\/+$/,"").split("/").filter(Boolean),r=n.pathname.replace(/\/+$/,"").split("/").filter(Boolean),s=t.endsWith("/*");if(!s&&a.length!==r.length||s&&r.length<a.length)return!1;for(let c=0;c<a.length;c++){const l=a[c],h=r[c];if(l!=="*"&&l!==h)return!1}return!0}catch{const i=n=>n.split(/[?#]/)[0];return i(o).startsWith(i(t.replace(/\/\*$/,"")))}}function k(){u.forEach((t,o)=>{if(document.contains(o)){const i=t.classList.contains("es-copy-indicator")?"copy":"paste";V(t,o,i)}else t.remove(),u.delete(o)})}window.addEventListener("scroll",k),window.addEventListener("resize",k),chrome.runtime.onMessage.addListener(async t=>{t.type==="UPDATE_OVERLAY_DATA"?(p=t.payload,await w(),b()):t.type==="TOGGLE_OVERLAY"?(f=t.payload.enabled,f?(await w(),b()):(u.forEach(o=>o.remove()),u.clear(),document.querySelectorAll(".es-element-highlight, .es-paste-highlight").forEach(o=>{o.classList.remove("es-element-highlight","es-paste-highlight")}))):t.type==="VARIABLE_UPDATED"?p.vars[t.payload.variableId]&&(p.vars[t.payload.variableId].value=t.payload.newValue,M(t.payload),await w()):t.type==="SHOW_FLOATING_VARS"&&(T(),v&&(L(),b()),localStorage.setItem("es-floating-window-auto-show","true"))}),window.addEventListener("storage",t=>{if(t.key===E){const o=I();o&&o.visible&&!d&&v?(L(),b()):o&&!o.visible&&d&&(d.remove(),d=null,v=!1)}else t.key===y&&T()}),window.addEventListener("beforeunload",()=>{localStorage.getItem(y)===_&&localStorage.removeItem(y)});function C(){chrome.runtime.sendMessage({type:"GET_OVERLAY_DATA"},t=>{if(chrome.runtime.lastError){setTimeout(C,1e3);return}if(t&&(p=t.data,f=t.enabled,console.log("PROFILE FILTERED page overlay initialized:",{enabled:f,vars:Object.keys(p.vars).length,sites:Object.keys(p.sites).length,profiles:Object.keys(p.profiles).length}),T(),f)){w();const o=I();localStorage.getItem("es-floating-window-auto-show")!=="false"&&Object.keys(p.vars).length>0&&(o&&o.visible&&v||!o&&v)&&(L(),b())}})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(C,100)):setTimeout(C,100),new MutationObserver(t=>{let o=!1;t.forEach(i=>{i.type==="childList"&&i.addedNodes.length>0&&i.addedNodes.forEach(n=>{var e,a;n.nodeType===1&&((e=n.matches)!=null&&e.call(n,"input, textarea, select, [contenteditable]")||(a=n.querySelector)!=null&&a.call(n,"input, textarea, select, [contenteditable]"))&&(o=!0)})}),o&&f&&(clearTimeout(window.__esUpdateTimeout),window.__esUpdateTimeout=setTimeout(w,500))}).observe(document.body,{childList:!0,subtree:!0}),console.log("Element Snapper PROFILE FILTERED page overlay initialized")})()})();
