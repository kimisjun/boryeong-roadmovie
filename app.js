(() => {
  'use strict';

  const KEYS = {
    plan: 'boryeong-sea-cut-plan-v1',
    checks: 'boryeong-sea-cut-checks-v1'
  };

  const PLANS = {
    sea: 'CUT A · 스카이바이크 + 해수욕',
    indoor: 'CUT B · 석탄박물관 + 개화예술공원'
  };

  const toastNode = document.querySelector('.toast');
  function toast(message) {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.classList.add('show');
    clearTimeout(toastNode._timer);
    toastNode._timer = setTimeout(() => toastNode.classList.remove('show'), 2200);
  }

  function setupCountdown() {
    const output = document.querySelector('[data-countdown]');
    if (!output) return;
    const target = new Date('2026-07-27T14:00:00+09:00').getTime();
    const tick = () => {
      let delta = target - Date.now();
      if (delta <= 0) {
        output.textContent = 'TRIP IN PROGRESS';
        return;
      }
      const days = Math.floor(delta / 86400000);
      delta %= 86400000;
      const hours = Math.floor(delta / 3600000);
      delta %= 3600000;
      const minutes = Math.floor(delta / 60000);
      const seconds = Math.floor((delta % 60000) / 1000);
      output.textContent = `D-${days} · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    tick();
    window.setInterval(tick, 1000);
  }

  function setupDays() {
    const buttons = [...document.querySelectorAll('[data-day-button]')];
    const panels = [...document.querySelectorAll('[data-day-panel]')];
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const day = button.dataset.dayButton;
        buttons.forEach((item) => {
          const selected = item === button;
          item.classList.toggle('active', selected);
          item.setAttribute('aria-selected', String(selected));
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.dayPanel !== day;
        });
      });
    });
  }

  function renderPlan(plan) {
    const label = PLANS[plan] || '아직 선택하지 않음';
    document.querySelectorAll('[data-plan-status]').forEach((node) => { node.textContent = label; });
    document.querySelectorAll('[data-plan-button]').forEach((button) => {
      const selected = button.dataset.planButton === plan;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    document.querySelectorAll('[data-plan-panel]').forEach((panel) => {
      panel.classList.toggle('selected', panel.dataset.planPanel === plan);
    });
  }

  function selectPlan(plan, announce = true) {
    if (!PLANS[plan]) return;
    localStorage.setItem(KEYS.plan, plan);
    renderPlan(plan);
    if (announce) toast(`${PLANS[plan]}로 저장했습니다.`);
  }

  function setupPlans() {
    renderPlan(localStorage.getItem(KEYS.plan));
    document.querySelectorAll('[data-plan-button]').forEach((button) => {
      button.addEventListener('click', () => {
        const plan = button.dataset.planButton;
        selectPlan(plan, false);
        document.querySelector(`[data-plan-panel="${plan}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    document.querySelectorAll('[data-select-plan]').forEach((button) => {
      button.addEventListener('click', () => selectPlan(button.dataset.selectPlan));
    });
  }

  function setupChecks() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEYS.checks) || '{}'); } catch (_) { saved = {}; }
    document.querySelectorAll('[data-check]').forEach((box) => {
      box.checked = Boolean(saved[box.dataset.check]);
      box.addEventListener('change', () => {
        saved[box.dataset.check] = box.checked;
        localStorage.setItem(KEYS.checks, JSON.stringify(saved));
        toast(box.checked ? '준비 완료로 표시했습니다.' : '체크를 해제했습니다.');
      });
    });
  }

  function setupShare() {
    document.querySelectorAll('[data-share]').forEach((button) => {
      button.addEventListener('click', async () => {
        const selected = localStorage.getItem(KEYS.plan);
        const data = {
          title: 'BORYEONG SEA CUT',
          text: `대천해수욕장 2박 3일 여행${PLANS[selected] ? ` · ${PLANS[selected]}` : ''}`,
          url: window.location.href
        };
        try {
          if (navigator.share) await navigator.share(data);
          else {
            await navigator.clipboard.writeText(window.location.href);
            toast('링크를 복사했습니다.');
          }
        } catch (error) {
          if (error.name !== 'AbortError') toast('주소창의 링크를 복사해 주세요.');
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupCountdown();
    setupDays();
    setupPlans();
    setupChecks();
    setupShare();
  });
})();
