/* Dependency-free frontend. All data and model calls go through the local API. */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nice = (value) => String(value).replaceAll('_', ' ');
const money = (value) => '$' + Number(value).toFixed(0);
let mood = 'any', limit = 12, searchVersion = 0, searchTimer, chatBusy = false, chatEpoch = 0;
let history = [], selected = new Map(), knownPlaces = new Map(), currentResults = [], chatResults = [];
let insightLoaded = false;

async function api(path, body) {
  const response = await fetch('/api/' + path, body === undefined ? {} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
  });
  if (!response.ok) {
    let message = 'The request could not be completed.';
    try { const error = await response.json(); if (typeof error.detail === 'string') message = error.detail; } catch (_) {}
    throw new Error(message + ' Please check your inputs and try again.');
  }
  return response.json();
}

function preferences() {
  return { budget: Number($('#budget').value), minutes: Number($('#minutes').value),
    group_size: Number($('#group-size').value), group_type: $('#group-type').value,
    district: $('#district').value, category: $('#category').value,
    environment: $('#environment').value, rain_friendly: $('#rain').checked,
    accessible: $('#accessible').checked, mood };
}

function toast(text) {
  $('#toast').textContent = text; $('#toast').style.display = 'block';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 3500);
}

function switchTab(tab) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === tab));
  $$('.nav').forEach(v => v.classList.toggle('active', v.dataset.tab === tab));
  if (tab === 'insights' && !insightLoaded) loadInsights();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function artwork(category) {
  const palettes = {
    cafe: ['#dfcfb4','#b6a28b','#6f8167'], park: ['#d5ddbd','#a0b68b','#6b885e'],
    riverside: ['#d8e2d9','#a9c4ba','#6f9387'], museum: ['#e3d6bb','#c4a67b','#8c7b5c'],
    art_gallery: ['#e1d5c5','#bc9f8d','#7e8c70'], workshop: ['#dfcdb9','#c09c7c','#788768'],
    food_market: ['#e5d1b2','#c29976','#8a9b73'], entertainment: ['#d3d7cd','#a0b09f','#70836c'],
    shopping: ['#e3d4c0','#bfa58a','#7e8d70'], wellness: ['#d7dfd0','#a4b69c','#718c72']
  };
  const [sky, main, green] = palettes[category] || palettes.park;
  let scene;
  if (['cafe','food_market','shopping'].includes(category)) {
    scene = `<rect x="69" y="44" width="174" height="108" rx="3" fill="#f2e6cb"/><path d="M58 68h195l-17-28H75Z" fill="${main}"/><path d="M66 68h180v17H66Z" fill="${green}"/><path d="M81 68v17m25-17v17m25-17v17m25-17v17m25-17v17m25-17v17m25-17v17" stroke="#eddfc0" stroke-width="12"/><rect x="88" y="98" width="42" height="40" fill="${main}"/><rect x="180" y="98" width="42" height="40" fill="${main}"/><rect x="145" y="105" width="23" height="47" rx="10" fill="${green}"/><path d="M23 153h264" stroke="${main}" stroke-width="6"/><circle cx="46" cy="119" r="24" fill="${green}"/><path d="M46 122v35m-8 0h17" stroke="#927b58" stroke-width="4"/>`;
  } else if (['museum','art_gallery','workshop'].includes(category)) {
    scene = `<rect x="76" y="86" width="160" height="64" fill="#eee0bc"/><path d="M62 87l33-32h124l32 32Z" fill="${main}"/><path d="M93 58l29-23h69l29 23Z" fill="${green}"/><path d="M145 36l12-23 13 23Z" fill="${main}"/><path d="M94 99v50m24-50v50m77-50v50m24-50v50" stroke="${main}" stroke-width="7"/><path d="M145 118q12-20 24 0v33h-24" fill="${green}"/><path d="M65 154h183m-198 8h212" stroke="${main}" stroke-width="6"/>`;
  } else if (category === 'riverside') {
    scene = `<path d="M0 119Q90 102 158 124T320 117V200H0Z" fill="${main}"/><path d="M0 148h80m30 13h90m30-18h80m-270 34h90" stroke="#e6ecdc" stroke-width="2"/><path d="M116 141h93l-20 12h-53Z" fill="${green}"/><path d="M163 140v-58l34 51h-34Z" fill="#f5ead0"/><path d="M0 110h320" stroke="${green}" stroke-width="5"/>`;
  } else {
    scene = `<path d="M0 133Q80 100 164 136T320 130V200H0Z" fill="${main}"/><path d="M145 200l7-57 28-24-14 28 36 53Z" fill="#eee5ca"/><path d="M53 147V87m195 60V72" stroke="#897f59" stroke-width="6"/><circle cx="53" cy="80" r="32" fill="${green}"/><circle cx="246" cy="70" r="37" fill="${green}"/><circle cx="102" cy="102" r="21" fill="${main}"/><path d="M91 143h43m-37 0v11m31-11v11" stroke="${green}" stroke-width="5"/>`;
  }
  return `<svg viewBox="0 0 320 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="320" height="190" fill="${sky}"/><circle cx="251" cy="36" r="22" fill="#f0e4c1"/><path d="M0 151Q85 128 170 150T320 147V190H0Z" fill="${main}" opacity=".6"/>${scene}<path d="M23 40q5-6 10 0 5-6 10 0m9 9q4-5 8 0 4-5 8 0" fill="none" stroke="${green}" stroke-width="1.5" opacity=".6"/></svg>`;
}

function card(row) {
  knownPlaces.set(row.attraction_id, row);
  const saved = selected.has(row.attraction_id);
  return `<article class="place-card"><div class="card-art">${artwork(row.category)}<span class="card-tag">${esc(nice(row.category))} · fictional</span><button class="save-button ${saved ? 'selected' : ''}" data-save="${esc(row.attraction_id)}" aria-label="${saved ? 'Remove from' : 'Add to'} day plan: ${esc(row.attraction_name)}" aria-pressed="${saved}">${saved ? '✓' : '+'}</button></div><div class="card-content"><div class="card-meta"><span>${esc(row.district.toUpperCase())}</span><span class="rating">★ ${Number(row.estimated_rating).toFixed(1)} demo</span></div><h3>${esc(row.attraction_name.replace(/^Demo /, ''))}</h3><p>${esc(row.interest_tags.split(';').map(nice).join(' · '))}</p><div class="card-tags"><span>${esc(row.suggested_duration_minutes)} min</span><span>${esc(row.environment)}</span>${row.rain_friendly ? '<span>Rain-friendly</span>' : ''}</div><div class="card-bottom"><span><strong>${money(row.estimated_total_cost_per_person_usd)}</strong> / person, est.</span><button class="detail-button" data-detail="${esc(row.attraction_id)}" aria-label="View details for ${esc(row.attraction_name)}">↗</button></div></div></article>`;
}

function renderCards(container, rows) {
  container.innerHTML = rows.length ? rows.map(card).join('') : '<div class="empty"><h3>A little change of plans?</h3><p>No places match those filters. Try a larger budget, more time, or a different setting.</p></div>';
}

async function search(shuffle = false) {
  const version = ++searchVersion;
  $('#cards').classList.add('loading'); $('#search-status').textContent = '';
  $('#roulette').disabled = true;
  try {
    const data = await api(shuffle ? 'roulette' : 'search', {query: $('#query').value, preferences: preferences(), limit});
    if (version !== searchVersion) return;
    currentResults = data.results;
    renderCards($('#cards'), currentResults);
    $('#results-count').innerHTML = shuffle ? `<strong>${data.results.length} lucky picks</strong> from ${data.total} matching demo places` : `<strong>${data.total} places</strong> match your kind of day · showing ${data.results.length}`;
    $('#load-more').hidden = shuffle || data.total <= limit || limit >= 50;
    if (shuffle) toast('A fresh little adventure, just for you.');
  } catch (error) {
    if (version === searchVersion) { $('#search-status').textContent = error.message; $('#results-count').textContent = 'Could not load places'; }
  } finally {
    if (version === searchVersion) { $('#cards').classList.remove('loading'); $('#roulette').disabled = false; }
  }
}

function renderSaved() {
  $('#saved-list').innerHTML = [...selected.values()].map(r => `<div class="saved-pill">${esc(r.attraction_name.replace(/^Demo /, ''))}<button data-remove="${esc(r.attraction_id)}" aria-label="Remove ${esc(r.attraction_name)}">×</button></div>`).join('');
  $('#build-plan').disabled = selected.size === 0;
  $('#plan-result').textContent = '';
  try { localStorage.setItem('weekend-roulette-ids', JSON.stringify([...selected.keys()])); } catch (_) {}
  renderCards($('#cards'), currentResults);
  if (chatResults.length) renderCards($('#chat-cards'), chatResults);
}

function toggleSave(id) {
  if (selected.has(id)) selected.delete(id);
  else {
    if (selected.size >= 3) return toast('A little day out fits up to 3 stops. Remove one to make room.');
    if (!knownPlaces.has(id)) return;
    selected.set(id, knownPlaces.get(id));
  }
  renderSaved();
}

function planMarkup(plan) {
  return `<div class="plan-result"><strong>${plan.within_budget && plan.within_time ? '✓ Your demo day fits.' : 'A little adjustment needed.'}</strong>${plan.stops.map((r, i) => `<div class="plan-stop">${i + 1}. ${esc(r.attraction_name)} · ${r.suggested_duration_minutes} min</div>`).join('')}<p class="${plan.within_budget && plan.within_time ? '' : 'warning'}">${money(plan.estimated_cost_per_person_usd)} per person · ${plan.total_minutes} minutes total (${plan.transfer_minutes} minutes of assumed transfers).<br>${plan.within_budget ? 'Within budget.' : 'Over your budget.'} ${plan.within_time ? 'Within your available time.' : 'Exceeds your available time.'}</p><small>${esc(plan.assumptions)}</small></div>`;
}

async function details(id) {
  try {
    const row = await api('attractions/' + encodeURIComponent(id));
    knownPlaces.set(id, row);
    const pairs = [ ['Estimated entry', money(row.estimated_entry_fee_usd)], ['Estimated food', money(row.estimated_food_cost_usd)],
      ['Estimated transport', money(row.estimated_transport_cost_usd)], ['Suggested duration', row.suggested_duration_minutes + ' minutes'],
      ['Demo hours', row.opening_time + ' – ' + row.closing_time], ['Setting', nice(row.environment)],
      ['Family-friendly', row.family_friendly ? 'Yes' : 'No'], ['Wheelchair access', row.wheelchair_accessible ? 'Yes' : 'No'],
      ['Rain-friendly', row.rain_friendly ? 'Yes' : 'No'], ['Reservation', row.reservation_required ? 'Required (demo)' : 'Not required (demo)'] ];
    $('#detail-content').innerHTML = `<div class="eyebrow">${esc(row.district)} · FICTIONAL DEMO PLACE</div><h2>${esc(row.attraction_name)}</h2><p>${esc(row.description)}</p><div class="detail-grid">${pairs.map(([label,value]) => `<div class="detail-item"><span>${esc(label)}</span>${esc(value)}</div>`).join('')}</div><p>Approximate coordinates: ${row.latitude}, ${row.longitude}. These are generated points, not venue locations. Prices, suitability, and hours are invented.</p><button class="button dark" data-save="${esc(id)}">${selected.has(id) ? 'Remove from' : 'Add to'} my day</button>`;
    if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
  } catch (error) { toast(error.message); }
}

function formatAssistantResponse(text) {
  const lines = esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').split(/\n+/).map(line => line.trim()).filter(Boolean);
  let html = '', list = null;
  const closeList = () => { if (list) html += `</${list}>`; list = null; };
  for (const line of lines) {
    const numbered = line.match(/^\d+\.\s+(.+)/), bullet = line.match(/^[•*-]\s+(.+)/);
    if (numbered || bullet) {
      const next = numbered ? 'ol' : 'ul';
      if (list !== next) { closeList(); html += `<${next}>`; list = next; }
      html += `<li>${numbered ? numbered[1] : bullet[1]}</li>`;
    } else { closeList(); html += `<p>${line}</p>`; }
  }
  closeList(); return html || '<p>I found a few ideas for you.</p>';
}

function addMessage(role, text) {
  const element = document.createElement('div'); element.className = 'message ' + role;
  if (role === 'assistant') element.innerHTML = formatAssistantResponse(text); else element.textContent = text;
  $('#messages').append(element); $('#messages').scrollTop = $('#messages').scrollHeight; return element;
}

async function sendChat(text) {
  text = text.trim(); if (!text || chatBusy) return;
  chatBusy = true; const epoch = chatEpoch;
  $('#send-chat').disabled = true; $('#chat-input').value = '';
  addMessage('user', text); const waiting = addMessage('assistant', 'Looking through the possibilities…'); waiting.classList.add('loading-message');
  try {
    const response = await api('chat', {message: text, history: history.slice(-6), preferences: preferences()});
    if (epoch !== chatEpoch) return;
    waiting.classList.remove('loading-message'); waiting.innerHTML = formatAssistantResponse(response.answer);
    history.push({role: 'user', content: text}, {role: 'assistant', content: response.answer.slice(0,1400)});
    history = history.slice(-6);
    chatResults = response.results; renderCards($('#chat-cards'), chatResults);
    $('#chat-plan').innerHTML = response.itinerary ? planMarkup(response.itinerary) : '';
  } catch (error) { if (epoch === chatEpoch) { waiting.textContent = error.message; waiting.classList.add('warning'); } }
  finally { chatBusy = false; $('#send-chat').disabled = false; $('#messages').scrollTop = $('#messages').scrollHeight; }
}

function bars(rows, label, value) {
  return rows.map(r => `<div class="bar-row"><span>${esc(nice(r[label]))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,Number(r[value])/5*100))}%"></div></div><span class="bar-value">${Number(r[value]).toFixed(2)}</span></div>`).join('');
}

async function loadInsights() {
  $('#insights-status').textContent = 'Loading the story behind the picks…';
  try {
    const data = await api('analytics'); const m = data.metrics;
    const stats = [[m.catalog_rows,'fictional places'],[m.experience_rows.toLocaleString(),'generated experiences'],[money(data.mean_budget),'average visitor budget'],[data.mean_satisfaction.toFixed(2) + '/5','synthetic satisfaction']];
    $('#stats').innerHTML = stats.map(([value,label]) => `<div class="stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('');
    $('#category-chart').innerHTML = bars(data.categories,'category','satisfaction');
    $('#weather-chart').innerHTML = bars(data.weather,'weather','satisfaction_score');
    const metrics = [['Model error (MAE)',m.mae.toFixed(3)],['Mean baseline error',m.baseline_mae.toFixed(3)],['R² score',m.r2.toFixed(3)],['Training / test rows',m.train_rows + ' / ' + m.test_rows],['Held-out attractions',m.test_attractions]];
    $('#model-metrics').innerHTML = metrics.map(([label,value]) => `<div class="metric-line"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('') + '<p>MAE is average error in satisfaction points. Lower is better. These metrics evaluate generated patterns only.</p>';
    $('#insights-status').textContent = ''; insightLoaded = true;
  } catch (error) { $('#insights-status').textContent = error.message; }
}

$$('.nav').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
$('#ask-companion').addEventListener('click', () => { switchTab('assistant'); $('#chat-input').focus(); });
$('#search-form').addEventListener('submit', event => { event.preventDefault(); limit=12; search(); });
$('#roulette').addEventListener('click', () => search(true));
$('#hero-roulette').addEventListener('click', () => { search(true); $('.discover-heading').scrollIntoView({behavior:'smooth'}); });
$('#load-more').addEventListener('click', () => { limit = Math.min(50,limit+12); search(); });
$$('.mood').forEach(button => button.addEventListener('click', () => { mood=button.dataset.mood; $$('.mood').forEach(b=>b.classList.toggle('active',b===button)); limit=12; search(); }));
$$('.filters input,.filters select').forEach(input => input.addEventListener('input', () => {
  $('#budget-label').textContent = money($('#budget').value); $('#plan-result').textContent = '';
  clearTimeout(searchTimer); searchTimer=setTimeout(()=>{limit=12;search();},250);
}));
$('#reset').addEventListener('click', () => {
  $('#budget').value=25; $('#budget-label').textContent='$25'; $('#minutes').value=240; $('#group-size').value=2;
  ['group-type','district','category','environment'].forEach(id=>$('#'+id).value='any');
  $('#rain').checked=false; $('#accessible').checked=false; $('#query').value=''; mood='any'; limit=12;
  $$('.mood').forEach(button=>button.classList.toggle('active',button.dataset.mood==='any'));
  $('#plan-result').textContent=''; search();
});
document.addEventListener('click', event => {
  const save=event.target.closest('[data-save]'), remove=event.target.closest('[data-remove]'), detail=event.target.closest('[data-detail]');
  if(save) { toggleSave(save.dataset.save); if($('#detail-dialog').open) $('#detail-dialog').close(); }
  if(remove) { selected.delete(remove.dataset.remove); renderSaved(); }
  if(detail) details(detail.dataset.detail);
});
$('#close-dialog').addEventListener('click',()=>$('#detail-dialog').close());
$('#detail-dialog').addEventListener('click',event=>{if(event.target===$('#detail-dialog')) $('#detail-dialog').close();});
$('#build-plan').addEventListener('click', async () => {
  const button=$('#build-plan'); button.disabled=true;
  try { const p=preferences(); const plan=await api('itinerary',{attraction_ids:[...selected.keys()],budget:p.budget,minutes:p.minutes}); $('#plan-result').innerHTML=planMarkup(plan); }
  catch(error){$('#plan-result').textContent=error.message;} finally{button.disabled=selected.size===0;}
});
$('#chat-form').addEventListener('submit',event=>{event.preventDefault();sendChat($('#chat-input').value);});
$$('[data-prompt]').forEach(button=>button.addEventListener('click',()=>sendChat(button.dataset.prompt)));
$('#clear-chat').addEventListener('click',()=>{
  if(chatBusy) return toast('Please wait for your current request to finish.');
  chatEpoch++;history=[];chatResults=[];$('#chat-cards').textContent='';$('#messages').textContent='';
  addMessage('assistant','A fresh start. What would make a good day for you?');
  $('#chat-plan').textContent='';
});

async function init() {
  try {
    const options=await api('options');
    for(const [id,values] of [['district',options.districts],['category',options.categories]]) {
      values.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=nice(value);$('#'+id).append(option);});
    }
    $('#agent-mode').textContent='Share your mood, group, time, or budget — your companion will suggest a few fitting places.';
    await search();
    try {
      const ids=JSON.parse(localStorage.getItem('weekend-roulette-ids')||'[]');
      if(Array.isArray(ids)) for(const id of ids.slice(0,3)) {
        if(typeof id!=='string')continue;
        try{const row=await api('attractions/'+encodeURIComponent(id));selected.set(id,row);}catch(_){}
      }
      if(selected.size)renderSaved();
    } catch(_){}
  } catch(error){$('#search-status').textContent='The app could not connect to its API. '+error.message;}
}
init();
