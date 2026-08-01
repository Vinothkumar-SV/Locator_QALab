let selected = null;
let pomItems = [];

const $ = id => document.getElementById(id);
const status = $("status");

async function activeTab() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  return tab;
}
async function send(msg) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab");
  return chrome.tabs.sendMessage(tab.id, msg);
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

$("inspectBtn").onclick = async () => {
  try {
    await send({type:"LOCATORX_START"});
    status.textContent = "Inspector active. Hover an element and click it.";
    window.close();
  } catch(e) {
    status.textContent = "Cannot inspect this page. Try a normal http/https page and reload it after installing the extension.";
  }
};
$("stopBtn").onclick = () => send({type:"LOCATORX_STOP"}).catch(()=>{});
$("clearBtn").onclick = () => {
  selected=null; $("results").classList.add("hidden"); $("elementCard").classList.add("hidden");
  status.textContent="Cleared.";
};

chrome.runtime.onMessage.addListener(msg => {
  if(msg.type==="LOCATORX_SELECTED"){
    selected=msg.payload;
    chrome.storage.local.set({locatorXSelected:selected});
  }
});

chrome.storage.local.get(["locatorXSelected","locatorXPom"], data => {
  if(data.locatorXSelected){selected=data.locatorXSelected; render();}
  if(Array.isArray(data.locatorXPom)){pomItems=data.locatorXPom; updatePomCount();}
});

function render(){
  if(!selected)return;
  $("elementCard").classList.remove("hidden");
  $("results").classList.remove("hidden");
  $("elementSummary").textContent =
    `<${selected.tag}>  ${selected.text || ""}\n` +
    Object.entries(selected.attributes||{}).slice(0,8).map(([k,v])=>`${k}="${v}"`).join("  ");
  $("count").textContent=`${selected.locators.length} candidates`;
  $("locatorList").innerHTML="";
  selected.locators.forEach((l,i)=>{
    const d=document.createElement("div"); d.className="locator";
    d.innerHTML=`<div class="locator-head"><strong>${esc(l.type)}</strong><span class="quality">${esc(l.quality)}</span></div>
      <div class="score">Health score: ${l.score}/100</div>
      <div class="code">${esc(l.code)}</div>
      <div class="meta">Matches: ${l.count} ${l.count===1?"✓ Unique":l.count>1?"⚠ Multiple":"✗ Not found"}</div>
      <div class="actions"><button data-copy="${i}">Copy</button><button data-test="${i}">Test</button></div>`;
    $("locatorList").appendChild(d);
  });
  document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>navigator.clipboard.writeText(selected.locators[+b.dataset.copy].code));
  document.querySelectorAll("[data-test]").forEach(b=>b.onclick=async()=>{
    const l=selected.locators[+b.dataset.test];
    try{const r=await send({type:"LOCATORX_TEST",candidate:l}); status.textContent=`${l.type}: ${r.count} matching element(s).`;}
    catch{status.textContent="Unable to test on this page.";}
  });
}

function safeName(s, fallback){
  let x=(s||"").replace(/[^a-zA-Z0-9]+(.)?/g,(_,c)=>c?c.toUpperCase():"");
  x=x.replace(/^[^a-zA-Z_$]+/,"");
  return x ? x[0].toLowerCase()+x.slice(1) : fallback;
}
function updatePomCount(){$("pomCount").textContent=`${pomItems.length} element${pomItems.length===1?"":"s"}`;}

$("addPomBtn").onclick=()=>{
  if(!selected){status.textContent="Inspect an element first.";return;}
  const best=selected.locators[0];
  const hint=selected.attributes.name||selected.attributes.id||selected.attributes["aria-label"]||selected.text||selected.tag;
  pomItems.push({name:safeName(hint,`element${pomItems.length+1}`),locator:best.code.replace(/^page\./,"this.page.")});
  chrome.storage.local.set({locatorXPom:pomItems});
  updatePomCount(); status.textContent="Selected element added to POM collector.";
};

$("generatePomBtn").onclick=()=>{
  const cls=($("className").value||"GeneratedPage").replace(/[^a-zA-Z0-9_$]/g,"");
  const uniq=[]; const seen={};
  pomItems.forEach(x=>{let n=x.name; seen[n]=(seen[n]||0)+1;if(seen[n]>1)n+=seen[n];uniq.push({...x,name:n});});
  const props=uniq.map(x=>`  readonly ${x.name}: Locator;`).join("\n");
  const assigns=uniq.map(x=>`    this.${x.name} = ${x.locator};`).join("\n");
  $("pomOutput").value=`import { Page, Locator } from '@playwright/test';

export class ${cls} {
  readonly page: Page;
${props}

  constructor(page: Page) {
    this.page = page;
${assigns}
  }
}
`;
};
$("copyPomBtn").onclick=()=>navigator.clipboard.writeText($("pomOutput").value);

$("allureBtn").onclick=()=>{
$("allureOutput").value=`# Install
npm i -D @playwright/test allure-playwright allure-commandline

// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['html'],
    ['allure-playwright', { outputFolder: 'allure-results' }]
  ]
});

// Example test
import { test, expect } from '@playwright/test';

test('locator generated test', async ({ page }) => {
  await test.step('Open application', async () => {
    await page.goto('https://example.com');
  });

  await test.step('Interact using generated locator', async () => {
    // Paste LocatorX generated locator here
  });
});

# Run and generate report
npx playwright test
npx allure generate allure-results --clean -o allure-report
npx allure open allure-report
`;
};
$("copyAllureBtn").onclick=()=>navigator.clipboard.writeText($("allureOutput").value);
render();