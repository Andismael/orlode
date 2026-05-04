/**
 * Orlode AI — Embeddable Chat Widget
 * Add to ANY website: WordPress, Wix, Shopify, custom HTML
 *
 * Usage:
 * <script src="https://orlode.com/embed.js" data-company="COMPANY_ID"></script>
 *
 * Options (data attributes):
 *   data-company    = Company ID (required)
 *   data-color      = Primary color (default: #6c3ce0)
 *   data-position   = "right" or "left" (default: right)
 *   data-title       = Chat title (default: company name)
 *   data-welcome    = Welcome message
 *   data-avatar     = Avatar emoji or URL
 */
(function() {
  'use strict';

  // Find our script tag
  var scripts = document.querySelectorAll('script[data-company]');
  var script = scripts[scripts.length - 1];
  if (!script) return;

  var companyId = script.getAttribute('data-company');
  if (!companyId) return;

  var color = script.getAttribute('data-color') || '#6c3ce0';
  var position = script.getAttribute('data-position') || 'right';
  var title = script.getAttribute('data-title') || 'Assistant IA';
  var welcome = script.getAttribute('data-welcome') || 'Bonjour ! Comment puis-je vous aider ?';
  var avatar = script.getAttribute('data-avatar') || '🤖';
  var API = 'https://api-15262322885.us-central1.run.app';

  // State
  var isOpen = false;
  var messages = [{ text: welcome, role: 'bot' }];
  var sessionId = null;
  var isLoading = false;

  // Create styles
  var style = document.createElement('style');
  style.textContent = [
    '.cm-widget{position:fixed;bottom:20px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '.cm-widget.' + position + '{' + position + ':20px}',
    '.cm-btn{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(0,0,0,0.2);transition:all .3s;font-size:24px}',
    '.cm-btn:hover{transform:scale(1.08);box-shadow:0 6px 30px rgba(0,0,0,0.3)}',
    '.cm-panel{position:absolute;bottom:72px;width:380px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 100px);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,0.25);opacity:0;transform:translateY(20px) scale(0.95);transition:all .3s;pointer-events:none}',
    '.cm-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}',
    '.cm-panel.' + position + '{' + position + ':0}',
    '.cm-header{padding:16px 20px;display:flex;align-items:center;gap:12px;color:#fff}',
    '.cm-header-avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:20px}',
    '.cm-header-info h3{margin:0;font-size:15px;font-weight:700}',
    '.cm-header-info p{margin:2px 0 0;font-size:11px;opacity:0.7}',
    '.cm-close{margin-left:auto;background:none;border:none;color:#fff;opacity:0.6;cursor:pointer;font-size:20px;padding:4px}',
    '.cm-close:hover{opacity:1}',
    '.cm-messages{flex:1;overflow-y:auto;padding:16px;background:#f8f9fa}',
    '.cm-msg{max-width:80%;margin-bottom:12px;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.5;word-wrap:break-word}',
    '.cm-msg.bot{background:#fff;border:1px solid #e5e7eb;border-radius:4px 16px 16px 16px;color:#1f2937;box-shadow:0 1px 3px rgba(0,0,0,0.05)}',
    '.cm-msg.user{margin-left:auto;color:#fff;border-radius:16px 4px 16px 16px}',
    '.cm-typing{display:flex;gap:4px;padding:10px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:4px 16px 16px 16px;width:fit-content;margin-bottom:12px}',
    '.cm-dot{width:7px;height:7px;border-radius:50%;background:#cbd5e1;animation:cm-bounce 1.4s infinite}',
    '.cm-dot:nth-child(2){animation-delay:.2s}',
    '.cm-dot:nth-child(3){animation-delay:.4s}',
    '@keyframes cm-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}',
    '.cm-input{display:flex;gap:8px;padding:12px 16px;border-top:1px solid #e5e7eb;background:#fff}',
    '.cm-input input{flex:1;border:1px solid #e5e7eb;border-radius:24px;padding:10px 16px;font-size:14px;outline:none;transition:border .2s}',
    '.cm-input input:focus{border-color:' + color + '}',
    '.cm-input button{width:40px;height:40px;border-radius:50%;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .2s}',
    '.cm-input button:disabled{opacity:0.4;cursor:not-allowed}',
    '.cm-powered{text-align:center;padding:6px;font-size:10px;color:#9ca3af;background:#fff;border-top:1px solid #f3f4f6}',
    '.cm-powered a{color:' + color + ';text-decoration:none;font-weight:600}',
  ].join('\n');
  document.head.appendChild(style);

  // Create widget HTML
  var widget = document.createElement('div');
  widget.className = 'cm-widget ' + position;

  // Panel
  var panel = document.createElement('div');
  panel.className = 'cm-panel ' + position;
  panel.style.background = '#f8f9fa';
  panel.innerHTML = [
    '<div class="cm-header" style="background:' + color + '">',
    '  <div class="cm-header-avatar">' + avatar + '</div>',
    '  <div class="cm-header-info"><h3>' + title + '</h3><p>En ligne — repond en ~5s</p></div>',
    '  <button class="cm-close" onclick="this.closest(\'.cm-panel\').classList.remove(\'open\')">&times;</button>',
    '</div>',
    '<div class="cm-messages" id="cm-msgs"></div>',
    '<div class="cm-input">',
    '  <input id="cm-input" placeholder="Ecrivez votre message..." />',
    '  <button id="cm-send" style="background:' + color + '">',
    '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>',
    '  </button>',
    '</div>',
    '<div class="cm-powered">Propulse par <a href="https://orlode.com" target="_blank">Orlode AI</a></div>',
  ].join('');

  // Button
  var btn = document.createElement('button');
  btn.className = 'cm-btn';
  btn.style.background = color;
  btn.innerHTML = avatar;

  widget.appendChild(panel);
  widget.appendChild(btn);
  document.body.appendChild(widget);

  // Render messages
  function render() {
    var msgsDiv = document.getElementById('cm-msgs');
    if (!msgsDiv) return;
    var html = '';
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      html += '<div class="cm-msg ' + m.role + '"' + (m.role === 'user' ? ' style="background:' + color + '"' : '') + '>' + escapeHtml(m.text) + '</div>';
    }
    if (isLoading) html += '<div class="cm-typing"><div class="cm-dot"></div><div class="cm-dot"></div><div class="cm-dot"></div></div>';
    msgsDiv.innerHTML = html;
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Toggle
  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.add('open');
      btn.innerHTML = '&times;';
      btn.style.fontSize = '28px';
      render();
      setTimeout(function() { document.getElementById('cm-input').focus(); }, 300);
    } else {
      panel.classList.remove('open');
      btn.innerHTML = avatar;
      btn.style.fontSize = '24px';
    }
  });

  // Send
  function send() {
    var input = document.getElementById('cm-input');
    var text = input.value.trim();
    if (!text || isLoading) return;
    input.value = '';
    messages.push({ text: text, role: 'user' });
    isLoading = true;
    render();

    fetch(API + '/api/public/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, language: 'fr', sessionId: sessionId, companyId: companyId }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      isLoading = false;
      if (data.success && data.data) {
        sessionId = data.data.sessionId;
        messages.push({ text: data.data.response, role: 'bot' });
      } else {
        messages.push({ text: 'Desole, une erreur est survenue.', role: 'bot' });
      }
      render();
    })
    .catch(function() {
      isLoading = false;
      messages.push({ text: 'Connexion impossible. Reessayez.', role: 'bot' });
      render();
    });
  }

  document.getElementById('cm-send').addEventListener('click', send);
  document.getElementById('cm-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') send();
  });

  render();
})();
