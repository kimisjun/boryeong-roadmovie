(() => {'use strict';
const KEYS={checks:'boryeong-sea-cut-checks-v1'};
const toastNode=document.querySelector('.toast');
function toast(message){if(!toastNode)return;toastNode.textContent=message;toastNode.classList.add('show');clearTimeout(toastNode._timer);toastNode._timer=setTimeout(()=>toastNode.classList.remove('show'),1800)}

function setupDays(){const bs=[...document.querySelectorAll('[data-day-button]')],ps=[...document.querySelectorAll('[data-day-panel]')];bs.forEach(b=>b.addEventListener('click',()=>{const d=b.dataset.dayButton;bs.forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-selected',String(on))});ps.forEach(x=>x.hidden=x.dataset.dayPanel!==d)}))}
function setupChecks(){let saved={};try{saved=JSON.parse(localStorage.getItem(KEYS.checks)||'{}')}catch(_){}document.querySelectorAll('[data-check]').forEach(box=>{box.checked=Boolean(saved[box.dataset.check]);box.addEventListener('change',()=>{saved[box.dataset.check]=box.checked;localStorage.setItem(KEYS.checks,JSON.stringify(saved));toast(box.checked?'체크 완료':'체크 해제')})})}
document.addEventListener('DOMContentLoaded',()=>{setupDays();setupChecks()});})();
